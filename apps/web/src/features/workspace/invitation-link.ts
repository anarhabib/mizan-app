let pendingToken: string | undefined;

export function rememberInvitationToken(token: string) {
  pendingToken = /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}

export function captureInvitationLink() {
  // This is the URL emitted by invitation-mail.ts. Scrub it before router startup.
  const match = /^\/invitations\/([^/]+)\/?$/.exec(window.location.pathname);
  if (!match || match[1] === "accept") return;
  rememberInvitationToken(match[1]);
  window.history.replaceState(window.history.state, "", "/invitations/accept");
}

export function getInvitationToken() {
  return pendingToken;
}

export function clearInvitationToken() {
  pendingToken = undefined;
}
