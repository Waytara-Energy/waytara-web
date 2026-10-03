import { ErrorFallback } from "@waytara/ui/error-fallback";

export default function NotFound() {
  return <ErrorFallback title="Page not found" description="The page you are looking for does not exist or has moved." homeHref="/" homeLabel="Go to home" />;
}
