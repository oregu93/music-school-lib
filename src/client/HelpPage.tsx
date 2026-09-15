import { ArrowLeft, Library } from "lucide-react";

const sections = [
  {
    title: "Поиск книги",
    items: [
      "Основной способ поиска — по инвентарному номеру.",
      "Также можно искать по № записи в БД, автору, заглавию или тексту.",
      "Если инвентарный номер встречается несколько раз, выберите нужную карточку.",
    ],
  },
  {
    title: "Карточка, выдача и возврат",
    items: [
      "Откройте полную карточку экземпляра и оформите выдачу.",
      "До возврата нельзя создать вторую активную выдачу того же экземпляра.",
      "После возврата история выдач сохраняется.",
    ],
  },
  {
    title: "Инвентаризация",
    items: [
      "Создайте или используйте текущую сессию инвентаризации.",
      "Введите или отсканируйте инвентарный номер.",
      "При одном совпадении экземпляр отмечается найденным; при нескольких выберите нужную карточку.",
      "Повторная отметка не создаёт дублирующее событие.",
    ],
  },
  {
    title: "Если пропал интернет",
    items: [
      "Операция может остаться на устройстве в ожидании синхронизации.",
      "Очередь сохраняется после перезагрузки страницы и закрытия вкладки.",
      "После восстановления связи операции отправляются повторно.",
      "При конфликте загрузите актуальную карточку и разрешите расхождение вручную.",
    ],
  },
  {
    title: "Корзина",
    items: [
      "Обычное удаление перемещает карточку в корзину, откуда её можно восстановить.",
      "Безвозвратно удаляйте только явно ошибочные или тестовые записи.",
    ],
  },
  {
    title: "Если возникла ошибка",
    items: [
      "Не повторяйте одну и ту же операцию много раз.",
      "Запишите инвентарный номер, время и текст ошибки; при возможности сделайте снимок экрана.",
      "Проверьте индикаторы ожидания синхронизации и конфликтов.",
    ],
  },
];

export function HelpPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-5 grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Library className="size-6" />
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Инструкция библиотекарю
          </h1>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Электронный каталог библиотеки музыкальной школы
          </p>
        </header>

        <div className="mt-5 grid gap-4">
          {sections.map((section, index) => (
            <section key={section.title} className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
              <h2 className="font-heading text-xl font-semibold">
                {index + 1}. {section.title}
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {section.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          ))}
        </div>

        <a
          href="/"
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <ArrowLeft className="size-4" />
          Вернуться в каталог
        </a>
      </div>
    </main>
  );
}
