export type CarolGesture = "touch" | "poke" | "pet" | "hold" | "tail";
export type CarolContact = {
  startX: number; startY: number; x: number; y: number;
  startedAt: number; movedAt: number; travel: number; gesture: CarolGesture;
};

export function beginCarolContact(x: number, y: number, now: number): CarolContact {
  return { startX: x, startY: y, x, y, startedAt: now, movedAt: now, travel: 0, gesture: "touch" };
}

export function moveCarolContact(contact: CarolContact, x: number, y: number, now: number): CarolContact {
  const distance = Math.hypot(x - contact.x, y - contact.y);
  const speed = distance / Math.max(1, now - contact.movedAt);
  const travel = contact.travel + distance;
  const gesture = travel > 9 && speed < 1.8 && speed > .008 ? "pet" : contact.gesture;
  return { ...contact, x, y, movedAt: now, travel, gesture };
}

export function heldCarolGesture(contact: CarolContact, now: number): CarolGesture {
  return contact.travel <= 9 && now - contact.startedAt >= 520 ? "hold" : contact.gesture;
}

export function finishCarolContact(contact: CarolContact, now: number): CarolGesture {
  const held = heldCarolGesture(contact, now);
  return held === "touch" && contact.travel <= 9 ? "poke" : held;
}
