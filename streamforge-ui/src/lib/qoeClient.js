export async function postQoeEvent(event) {
  const res = await fetch("/api/qoe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`POST /api/qoe failed ${res.status}: ${txt}`);
  }
}
