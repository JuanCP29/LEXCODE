// Contraseña temporal legible (evita 0/O, 1/l/I) que el usuario cambiará al entrar.
export function generarPassword(): string {
  const may = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const min = "abcdefghijkmnpqrstuvwxyz";
  const num = "23456789";
  const todo = may + min + num;
  const r = (s: string) => s[Math.floor(Math.random() * s.length)];
  let p = r(may) + r(min) + r(num);
  for (let i = 0; i < 9; i++) p += r(todo);
  return p.split("").sort(() => Math.random() - 0.5).join("");
}
