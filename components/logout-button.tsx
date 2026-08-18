import { logoutAction } from "@/app/_actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="outline" size="sm">
        Cerrar sesión
      </Button>
    </form>
  );
}
