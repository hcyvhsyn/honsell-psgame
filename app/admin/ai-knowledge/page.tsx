import AiKnowledgeAdminClient from "./AiKnowledgeAdminClient";

export const dynamic = "force-dynamic";

export default function AdminAiKnowledgePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">AI Bilik Bazası</h1>
        <p className="text-sm text-zinc-400">
          &laquo;AI-dan soruş&raquo; köməkçisinin biliyi. Yalnız aktiv girişlər köməkçiyə
          ötürülür. Oyun və film/serial məlumatları onsuz da avtomatik kataloqdan
          gəlir — burada saytın bölmələri, qaydaları və izahları saxlanılır.
        </p>
      </div>

      <AiKnowledgeAdminClient />
    </div>
  );
}
