import { revalidatePath } from "next/cache";

export function revalidateMessageRoutes() {
  revalidatePath("/about");
  revalidatePath("/editor");
}
