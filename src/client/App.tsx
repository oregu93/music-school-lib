'use client';

import { useEffect, useState } from "react";
import { Library, LogIn } from "lucide-react";
import { Button } from "../../components/ui/button";
import { CatalogClient } from "../../app/catalog-client";
import { HelpPage } from "./HelpPage";

type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "librarian";
};

type SessionResponse = {
  authenticated: boolean;
  user: SessionUser | null;
};

export default function App() {
  if (window.location.pathname === "/help") {
    return <HelpPage />;
  }

  const [loading, setLoading] = useState(true);

  const [session, setSession] =
    useState<SessionResponse>({
      authenticated: false,
      user: null,
    });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/session", {
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            "Не удалось проверить сессию",
          );
        }

        return response.json() as Promise<SessionResponse>;
      })
      .then((value) => {
        if (!cancelled) {
          setSession(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSession({
            authenticated: false,
            user: null,
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
        <div className="text-center">
          <Library className="mx-auto mb-3 size-9 text-primary" />
          <p className="text-sm text-muted-foreground">
            Проверка доступа…
          </p>
        </div>
      </main>
    );
  }

  if (!session.authenticated || !session.user) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
        <section className="w-full max-w-md rounded-2xl border bg-card p-7 text-center shadow-sm">
          <div className="mx-auto mb-5 grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Library className="size-6" />
          </div>

          <h1 className="font-heading text-2xl font-semibold">
            Электронный каталог
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Библиотека музыкальной школы
          </p>

          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            Доступ разрешён только сотрудникам,
            добавленным в список пользователей каталога.
          </p>

          <Button
            className="mt-6 w-full gap-2"
            onClick={() => {
              window.location.href =
                "/api/auth/login";
            }}
          >
            <LogIn className="size-4" />
            Войти через Яндекс ID
          </Button>

          <a
            href="/help"
            className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Инструкция библиотекарю
          </a>
        </section>
      </main>
    );
  }

  return (
    <CatalogClient
      userName={session.user.displayName}
    />
  );
}
