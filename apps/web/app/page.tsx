
import WebContainerIDE from "@/components/WebContainer";
import { prisma } from "@repo/db/prisma"
export default async function Home() {
  return (
    <div>
      <div>
        <WebContainerIDE/>
      </div>
    </div>
  );
}
