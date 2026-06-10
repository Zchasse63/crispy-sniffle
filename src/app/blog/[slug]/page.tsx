import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { POSTS, getPost } from "@/lib/blog";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Post not found — Scout" };
  return {
    title: `${post.title} — Scout Field Notes`,
    description: post.description,
    openGraph: { title: post.title, description: post.description, type: "article" },
  };
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <article className="survey-grid mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <Link
        href="/blog"
        className="readout inline-flex items-center gap-1.5 text-ink/70 transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All field notes
      </Link>
      <p className="font-mono mt-6 text-[10px] uppercase tracking-wider text-ink/55">
        {new Date(`${post.date}T12:00:00`).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>
      <h1 className="display mt-2 text-3xl leading-tight text-ink sm:text-4xl">
        {post.title}
      </h1>
      <div className="mt-6 space-y-4">
        {post.blocks.map((b, i) =>
          b.t === "h2" ? (
            <h2 key={i} className="display pt-2 text-xl text-ink">
              {b.text}
            </h2>
          ) : b.t === "ul" ? (
            <ul key={i} className="space-y-2.5">
              {b.items.map((item, j) => (
                <li
                  key={j}
                  className="rounded-lg border border-paper-line bg-paper-raise p-3.5 text-sm leading-relaxed text-ink/85"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p key={i} className="text-[15px] leading-relaxed text-ink/85">
              {b.text}
            </p>
          ),
        )}
      </div>
      <p className="mt-8 border-t border-paper-line pt-5 text-sm text-ink/75">
        Explore the data behind this post on{" "}
        <Link href="/" className="font-semibold text-pool-deep underline decoration-pool/40 underline-offset-2">
          the Tampa gym map →
        </Link>
      </p>
    </article>
  );
}
