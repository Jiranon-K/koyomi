import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/features/auth/auth";

export const { GET, POST } = toNextJsHandler(async (request) => (await getAuth()).handler(request));
