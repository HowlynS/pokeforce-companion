import Link from "next/link";
import { cataloguePageHref } from "@/lib/catalogue-query";

type CataloguePaginationProps = {
  basePath: string;
  currentPage: number;
  pageCount: number;
  label: string;
  query?: Record<string, string | string[] | undefined>;
};

export function CataloguePagination({
  basePath,
  currentPage,
  pageCount,
  label,
  query,
}: CataloguePaginationProps) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <nav className="public-catalogue-pagination" aria-label={label}>
      {currentPage > 1 ? (
        <Link href={cataloguePageHref(basePath, currentPage - 1, query)}>
          Previous
        </Link>
      ) : (
        <span aria-disabled="true">Previous</span>
      )}
      <span>
        Page {currentPage} of {pageCount}
      </span>
      {currentPage < pageCount ? (
        <Link href={cataloguePageHref(basePath, currentPage + 1, query)}>
          Next
        </Link>
      ) : (
        <span aria-disabled="true">Next</span>
      )}
    </nav>
  );
}
