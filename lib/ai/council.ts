import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { callLlm } from "@/lib/ai/llm";
import { CHAIRMAN_MODEL, MEMBER_MODELS } from "@/lib/ai/models";

export type Persona = { name: string; brief: string };

export type CouncilConfig<O extends z.ZodType, D extends z.ZodType> = {
  syncRunId: number;
  cycle: 1 | 2;
  task: string;
  data: unknown;
  personas: readonly Persona[];
  opinionSchema: O;
  decisionSchema: D;
};

export type CouncilOutcome<D> = { councilRunId: number; decision: D };

type Seat = { seatId: number; persona: Persona; label: string; model: string };
type Opinion<T> = { seat: Seat; response: T };
type Review = { seat: Seat; review: z.infer<typeof reviewSchema> };

const LABELS = ["A", "B", "C", "D"] as const;
const MIN_OPINIONS = 2;

const reviewSchema = z.object({
  critiques: z.array(z.object({ label: z.string(), strengths: z.string(), concerns: z.string() })),
  ranking: z.array(z.string()),
});

const seatRowSchema = z.object({ seat_id: z.number(), persona: z.string(), label: z.string().nullable() });
const councilRunRowSchema = z.object({ council_run_id: z.number() });

export async function runCouncil<O extends z.ZodType, D extends z.ZodType>(
  config: CouncilConfig<O, D>,
): Promise<CouncilOutcome<z.output<D>>> {
  assertPersonaCount(config.personas);
  const councilRunId = await insertCouncilRun(config.syncRunId, config.cycle);
  const members = await insertMemberSeats(councilRunId, config.personas);
  const chairmanSeatId = await insertChairmanSeat(councilRunId);
  const opinions = await collectOpinions(config, members);
  const reviews = await collectReviews(config, opinions);
  const decision = await callChairman(config, chairmanSeatId, opinions, reviews);
  return { councilRunId, decision };
}

function assertPersonaCount(personas: readonly Persona[]): void {
  if (personas.length !== MEMBER_MODELS.length) {
    throw new Error(`Council needs ${MEMBER_MODELS.length} personas, got ${personas.length}`);
  }
}

async function insertCouncilRun(syncRunId: number, cycle: 1 | 2): Promise<number> {
  const { data, error } = await getDb()
    .from("council_runs")
    .insert({ sync_run_id: syncRunId, cycle })
    .select("council_run_id")
    .single();
  if (error) throw error;
  return councilRunRowSchema.parse(data).council_run_id;
}

async function insertMemberSeats(councilRunId: number, personas: readonly Persona[]): Promise<Seat[]> {
  const labels = shuffle([...LABELS]);
  const { data, error } = await getDb()
    .from("council_seats")
    .insert(
      personas.map((persona, i) => ({
        council_run_id: councilRunId,
        role: "member",
        persona: persona.name,
        label: labels[i],
      })),
    )
    .select("seat_id, persona, label");
  if (error) throw error;
  return z
    .array(seatRowSchema)
    .parse(data)
    .map((row) => toSeat(row, personas));
}

function toSeat(row: z.infer<typeof seatRowSchema>, personas: readonly Persona[]): Seat {
  const index = personas.findIndex((persona) => persona.name === row.persona);
  if (index === -1 || !row.label) {
    throw new Error(`Unexpected council seat ${row.seat_id}`);
  }
  return { seatId: row.seat_id, persona: personas[index], label: row.label, model: MEMBER_MODELS[index] };
}

async function insertChairmanSeat(councilRunId: number): Promise<number> {
  const { data, error } = await getDb()
    .from("council_seats")
    .insert({ council_run_id: councilRunId, role: "chairman", persona: "Chairman", label: null })
    .select("seat_id, persona, label")
    .single();
  if (error) throw error;
  return seatRowSchema.parse(data).seat_id;
}

async function collectOpinions<O extends z.ZodType, D extends z.ZodType>(
  config: CouncilConfig<O, D>,
  members: Seat[],
): Promise<Opinion<z.output<O>>[]> {
  const results = await Promise.allSettled(
    members.map((seat) =>
      callLlm({
        syncRunId: config.syncRunId,
        model: seat.model,
        system: memberSystemPrompt(seat.persona, config.task),
        user: JSON.stringify({ data: config.data }),
        schemaName: `cycle${config.cycle}_opinion`,
        schema: config.opinionSchema,
        seat: { seatId: seat.seatId, stage: "opinion" },
      }),
    ),
  );
  const opinions = results.flatMap((result, i) =>
    result.status === "fulfilled" ? [{ seat: members[i], response: result.value.output }] : [],
  );
  if (opinions.length < MIN_OPINIONS) {
    throw new Error(`Cycle ${config.cycle}: only ${opinions.length} council opinions succeeded`);
  }
  return opinions;
}

async function collectReviews<O extends z.ZodType, D extends z.ZodType>(
  config: CouncilConfig<O, D>,
  opinions: Opinion<z.output<O>>[],
): Promise<Review[]> {
  const results = await Promise.allSettled(
    opinions.map(({ seat }) =>
      callLlm({
        syncRunId: config.syncRunId,
        model: seat.model,
        system: reviewerSystemPrompt(seat.persona, config.task),
        user: JSON.stringify({
          data: config.data,
          responses: opinions
            .filter((other) => other.seat.seatId !== seat.seatId)
            .map((other) => ({ label: `Response ${other.seat.label}`, response: other.response })),
        }),
        schemaName: `cycle${config.cycle}_review`,
        schema: reviewSchema,
        seat: { seatId: seat.seatId, stage: "review" },
      }),
    ),
  );
  return results.flatMap((result, i) =>
    result.status === "fulfilled" ? [{ seat: opinions[i].seat, review: result.value.output }] : [],
  );
}

async function callChairman<O extends z.ZodType, D extends z.ZodType>(
  config: CouncilConfig<O, D>,
  chairmanSeatId: number,
  opinions: Opinion<z.output<O>>[],
  reviews: Review[],
): Promise<z.output<D>> {
  const { output } = await callLlm({
    syncRunId: config.syncRunId,
    model: CHAIRMAN_MODEL,
    system: chairmanSystemPrompt(config.personas, config.task),
    user: JSON.stringify({
      data: config.data,
      opinions: opinions.map(({ seat, response }) => ({
        label: `Response ${seat.label}`,
        persona: seat.persona.name,
        response,
      })),
      peer_reviews: reviews.map(({ seat, review }) => ({ reviewer: `Response ${seat.label}`, ...review })),
    }),
    schemaName: `cycle${config.cycle}_decision`,
    schema: config.decisionSchema,
    seat: { seatId: chairmanSeatId, stage: "decision" },
  });
  return output;
}

function memberSystemPrompt(persona: Persona, task: string): string {
  return [
    `You are a member of a hospital inventory council. Your persona: ${persona.name}.`,
    persona.brief,
    `Task: ${task}`,
    "Answer independently from your persona's point of view.",
  ].join("\n");
}

function reviewerSystemPrompt(persona: Persona, task: string): string {
  return [
    `You are a member of a hospital inventory council. Your persona: ${persona.name}.`,
    persona.brief,
    `The council's task: ${task}`,
    "You are given the other members' anonymised responses and the same data they saw.",
    "Critique each response (label, strengths, concerns) and rank the responses from best to worst using their labels.",
  ].join("\n");
}

function chairmanSystemPrompt(personas: readonly Persona[], task: string): string {
  return [
    "You are the chairman of a hospital inventory council. You have no persona.",
    `Task: ${task}`,
    "You receive each member's opinion and the anonymised peer reviews. Members argue from deliberate biases:",
    ...personas.map((persona) => `- ${persona.name}: ${persona.brief}`),
    "Weigh the arguments against the data, discount bias, and make the final decision. Do not simply average or follow the majority.",
  ].join("\n");
}

function shuffle<T>(values: T[]): T[] {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}
