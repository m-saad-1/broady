import Link from "next/link";

type VerifyReminderPageProps = {
  searchParams?: Promise<{ email?: string }>;
};

export default async function VerifyReminderPage({ searchParams }: VerifyReminderPageProps) {
  const params = (await searchParams) || {};
  const email = params.email || "your email";

  return (
    <main className="mx-auto w-full max-w-lg space-y-8 px-4 py-20 text-center">
      <h1 className="font-heading text-4xl uppercase">Check Your Email</h1>
      <p className="text-zinc-600">
        We&apos;ve sent a verification link to <strong>{email}</strong>. Please click the link to verify your account and sign in.
      </p>
      <p className="text-sm text-zinc-600">
        After verifying, continue to <Link href="/login" className="underline">login</Link>.
      </p>
    </main>
  );
}
