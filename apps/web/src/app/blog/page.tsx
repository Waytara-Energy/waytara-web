import { BlogHub } from "@/components/pages/blog-hub";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "WayTara Blog: Solar, EV Charging, Licences",
  description: "Straight answers on contractor licences, connecting existing equipment, the WayTara gateway, EV chargers, solar subsidy and bills.",
  path: "/blog",
});

export default function Page() {
  return <BlogHub />;
}
