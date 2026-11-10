import type {
	CreateRecurringExpenseBody,
	DueRecurringExpensesQuery,
	ListRecurringExpensesQuery,
	PostDueRecurringExpenseBody,
	UpdateRecurringExpenseBody,
} from "@finance-application/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ACCOUNTS_QUERY_KEY } from "@/services/accounts-service";
import {
	cancelExistingRecurringExpense,
	createNewRecurringExpense,
	DUE_RECURRING_EXPENSES_QUERY_KEY,
	dueRecurringExpensesQueryOptions,
	editRecurringExpense,
	pauseExistingRecurringExpense,
	postExistingDueRecurringExpense,
	RECURRING_EXPENSES_QUERY_KEY,
	recurringExpensesQueryOptions,
	resumeExistingRecurringExpense,
	skipExistingRecurringExpense,
} from "@/services/recurring-expenses-service";
import { REPORTS_QUERY_KEY } from "@/services/reports-service";
import { TRANSACTIONS_QUERY_KEY } from "@/services/transactions-service";
import { ACTIVITY_QUERY_KEY } from "@/services/transfers-service";

export function useRecurringExpenses(
	filters: Partial<ListRecurringExpensesQuery> = {},
) {
	return useQuery(recurringExpensesQueryOptions(filters));
}

export function useDueRecurringExpenses(
	query: Partial<DueRecurringExpensesQuery> = {},
) {
	return useQuery(dueRecurringExpensesQueryOptions(query));
}

function useInvalidateRecurring() {
	const queryClient = useQueryClient();
	return () => {
		queryClient.invalidateQueries({
			queryKey: RECURRING_EXPENSES_QUERY_KEY,
		});
		queryClient.invalidateQueries({
			queryKey: DUE_RECURRING_EXPENSES_QUERY_KEY,
		});
	};
}

function useInvalidateRecurringAndLedger() {
	const queryClient = useQueryClient();
	return () => {
		queryClient.invalidateQueries({
			queryKey: RECURRING_EXPENSES_QUERY_KEY,
		});
		queryClient.invalidateQueries({
			queryKey: DUE_RECURRING_EXPENSES_QUERY_KEY,
		});
		queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: ACTIVITY_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: REPORTS_QUERY_KEY });
	};
}

export function useCreateRecurringExpense() {
	const invalidate = useInvalidateRecurring();
	return useMutation({
		mutationFn: (body: CreateRecurringExpenseBody) =>
			createNewRecurringExpense(body),
		onSuccess: invalidate,
	});
}

export function useUpdateRecurringExpense() {
	const invalidate = useInvalidateRecurring();
	return useMutation({
		mutationFn: ({
			id,
			body,
		}: {
			id: string;
			body: UpdateRecurringExpenseBody;
		}) => editRecurringExpense(id, body),
		onSuccess: invalidate,
	});
}

export function usePauseRecurringExpense() {
	const invalidate = useInvalidateRecurring();
	return useMutation({
		mutationFn: (id: string) => pauseExistingRecurringExpense(id),
		onSuccess: invalidate,
	});
}

export function useResumeRecurringExpense() {
	const invalidate = useInvalidateRecurring();
	return useMutation({
		mutationFn: (id: string) => resumeExistingRecurringExpense(id),
		onSuccess: invalidate,
	});
}

export function useCancelRecurringExpense() {
	const invalidate = useInvalidateRecurring();
	return useMutation({
		mutationFn: (id: string) => cancelExistingRecurringExpense(id),
		onSuccess: invalidate,
	});
}

export function useSkipRecurringExpense() {
	const invalidate = useInvalidateRecurring();
	return useMutation({
		mutationFn: (id: string) => skipExistingRecurringExpense(id),
		onSuccess: invalidate,
	});
}

export function usePostDueRecurringExpense() {
	const invalidate = useInvalidateRecurringAndLedger();
	return useMutation({
		mutationFn: ({
			id,
			body,
		}: {
			id: string;
			body: PostDueRecurringExpenseBody;
		}) => postExistingDueRecurringExpense(id, body),
		onSuccess: invalidate,
	});
}
