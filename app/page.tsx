import ProspectForm from "@/component/propects/prospect-form-input";
import { listAssignableUsers } from "@/src/services/user.service";

export default async function Home() {
  const assignableUsers = await listAssignableUsers();

  return <ProspectForm assignableUsers={assignableUsers} />;
}
