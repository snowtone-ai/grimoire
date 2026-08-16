import { ItemDetailLoader } from "@/components/book/item-detail-loader";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ dropId: string }>;
}) {
  const { dropId } = await params;
  return <ItemDetailLoader dropId={dropId} />;
}
