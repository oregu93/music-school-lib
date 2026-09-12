import { getChatGPTUser } from './chatgpt-auth';
import { CatalogClient } from './catalog-client';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getChatGPTUser();
  return <CatalogClient userName={user?.displayName ?? 'Библиотекарь'} />;
}
