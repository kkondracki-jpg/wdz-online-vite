export function buildFamilyLink(roomCode, fId) {
  var base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, "/");
  return base + "?s=" + roomCode + "&f=" + fId;
}
