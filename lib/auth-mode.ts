export const localAuthBypassEnabled =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_LOCAL_AUTH_BYPASS !== "false";
