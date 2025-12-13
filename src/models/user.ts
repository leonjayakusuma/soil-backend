export interface User {
    id: number;
    name: string;
    email: string;
    createdAt?: string;
}
export let users: User[] = [];
