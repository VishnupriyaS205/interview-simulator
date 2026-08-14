export default function StatCard({ label, value, note }) {
  return (
    <article className="stat-card">
      <p>{label}</p>
      <strong>{value}</strong>
      {note && <span>{note}</span>}
    </article>
  );
}
