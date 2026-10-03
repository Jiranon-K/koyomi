export function cookieHeaders(responseHeaders: Headers): Headers {
  const cookie = responseHeaders
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}
