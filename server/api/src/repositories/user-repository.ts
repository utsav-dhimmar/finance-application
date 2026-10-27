import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { users, type User } from "@/db/schema";

export interface NewUserRow {
	id: string;
	email: string;
	passwordHash: string;
	createdAt: string;
	updatedAt: string;
}

export function createUserRepository(db: Db) {
	return {
		async findByEmail(email: string): Promise<User | undefined> {
			const found = await db
				.select()
				.from(users)
				.where(eq(users.email, email))
				.limit(1);
			return found[0];
		},

		async findById(id: string): Promise<User | undefined> {
			const found = await db
				.select()
				.from(users)
				.where(eq(users.id, id))
				.limit(1);
			return found[0];
		},

		async insert(row: NewUserRow): Promise<{ id: string; email: string }> {
			const inserted = await db
				.insert(users)
				.values(row)
				.returning({ id: users.id, email: users.email });
			const user = inserted[0];
			if (!user) {
				throw new Error("user insert returned no rows");
			}
			return user;
		},
	};
}

export type UserRepository = ReturnType<typeof createUserRepository>;
