import AdminShell from "@/component/dashboard/AdminShell";
import CommercialShell from "@/component/commercial/CommercialShell";
import ProductDirectoryCard from "@/component/products/ProductDirectoryCard";
import { requireRole } from "@/src/services/authorization.service";
import { getProductDirectoryOverview } from "@/src/services/product-directory.service";

export default async function ProductsPage() {
  const user = await requireRole("ADMIN", "MANAGER", "COMMERCIAL");
  const overview = await getProductDirectoryOverview();

  const content = (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
          Répertoire
        </h1>
        <p className="mt-2 max-w-2xl text-base text-slate-500">
          Consultez les prospects déjà enregistrés avant de planifier une
          visite ou une prise de contact.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {overview.map((item) => (
          <ProductDirectoryCard key={item.product} item={item} />
        ))}
      </div>
    </div>
  );

  if (user.role === "COMMERCIAL") {
    return (
      <CommercialShell firstName={user.firstName} lastName={user.lastName}>
        <main className="px-4 py-6 sm:px-6 sm:py-8">{content}</main>
      </CommercialShell>
    );
  }

  return <AdminShell activeItem="products">{content}</AdminShell>;
}
