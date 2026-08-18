import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Card className="w-full max-w-md gap-6 px-2 py-6 shadow-xl sm:px-4 sm:py-8">
      <CardHeader className="flex flex-col items-center gap-1 px-2 text-center">
        <Logo
          stacked
          showTagline
          markClassName="size-28"
          textClassName="text-3xl"
          className="mb-2"
        />
        <CardDescription className="text-base">
          Ingresá con tu email y contraseña.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        <LoginForm />
      </CardContent>
    </Card>
  );
}
