import { requireAdmin } from "@/server/require-admin";
import CreatePostForm from "./create-form";

interface CreatePostPageProps {
  params: Promise<{ locale: string }>;
}

export default async function CreatePostPage({ params }: CreatePostPageProps) {
  const { locale } = await params;

  await requireAdmin(locale, "/posts/create");

  return <CreatePostForm />;
}
