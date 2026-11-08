import type { Table as TanStackTable } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@finance-application/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@finance-application/ui/components/table";
import type { CoreTableFeatures } from "@/lib/table-features";

interface PanelTableProps<TData extends { id: string }> {
	table: TanStackTable<CoreTableFeatures, TData>;
}

// The table shell shared by the archive/trash transaction and transfer
// panels: a bordered horizontal-scroll container whose header and rows are
// rendered from the caller's TanStack table instance. Rows are keyed by the
// record id.
export function PanelTable<TData extends { id: string }>({
	table,
}: PanelTableProps<TData>) {
	return (
		<div className="w-full overflow-x-auto rounded-xl border border-border/80">
			<Table className="min-w-[640px]">
				<TableHeader>
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map((header) => (
								<TableHead key={header.id}>
									{header.isPlaceholder
										? null
										: flexRender(
												header.column.columnDef.header,
												header.getContext(),
											)}
								</TableHead>
							))}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows.map((row) => (
						<TableRow key={row.original.id}>
							{row.getAllCells().map((cell) => (
								<TableCell key={cell.id}>
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

interface PanelPaginationProps {
	page: number;
	pageCount: number;
	total: number;
	onPageChange: (page: number) => void;
}

// The page summary and Prev/Next controls shared by the archive/trash list
// panels. Pagination is manual, so the caller owns the page state.
export function PanelPagination({
	page,
	pageCount,
	total,
	onPageChange,
}: PanelPaginationProps) {
	return (
		<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<p className="text-sm text-muted-foreground">
				Page {page} of {pageCount} · {total} total
			</p>
			<div className="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={page <= 1}
					onClick={() => onPageChange(Math.max(1, page - 1))}
				>
					<ChevronLeft aria-hidden="true" className="size-4" />
					Prev
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={page >= pageCount}
					onClick={() => onPageChange(Math.min(pageCount, page + 1))}
				>
					Next
					<ChevronRight aria-hidden="true" className="size-4" />
				</Button>
			</div>
		</div>
	);
}
