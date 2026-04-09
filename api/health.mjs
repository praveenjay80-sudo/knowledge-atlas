export function GET() {
  try {
    return Response.json({
        ok: true,
        apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
      });
  } catch (error) {
    return Response.json(
      {
        error: error?.message || "Health check crashed.",
      },
      { status: 500 },
    );
  }
}
