// Client-side safety net only: if the chat API is unreachable and the message looks like an
// emergency, still show the DDPM 1784 card. Real triage happens in the backend.
const DANGER = /น้ำเข้าบ้าน|ติดอยู่|ติดค้าง|ช่วยด้วย|ช่วยที|ออกไม่ได้|จมน้ำ|ต้องการความช่วยเหลือ|ฉุกเฉิน/;

export function looksLikeEmergency(text: string): boolean {
  return DANGER.test(text);
}
