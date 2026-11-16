import { BlogHub } from "@/components/pages/blog-hub";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Blog: Partner Licences, Gateway, EV Charging, Solar and Subsidy",
  description: "Straight answers on contractor licences, connecting existing equipment, the WayTara gateway, EV chargers, solar subsidy and bills.",
  path: "/blog",
});

export default function Page() {
  return <BlogHub />;
}
