export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", color: "#1A1118" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>💕 Valentine API</h1>
      <p style={{ color: "#8A7080" }}>Backend corriendo correctamente.</p>
      <p style={{ marginTop: "1rem" }}>
        Endpoint principal: <code>/api/chat</code> (POST)
        <br />
        Health check: <code>/api/health</code> (GET)
      </p>
    </main>
  );
}