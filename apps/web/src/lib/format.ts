export const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export const formatDate = (date: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));

export const monthLabel = (month: string) => {
  const [year, value] = month.split("-");
  return new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(Number(year), Number(value) - 1, 1));
};
