import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap">
      <section className="hero">
        <h1>That page isn&apos;t here.</h1>
        <p className="lede">The company may be outside the tracker, or the link is out of date.</p>
        <p style={{ marginTop: 20 }}><Link className="btn" href="/">Back to the overview</Link></p>
      </section>
    </main>
  );
}
