import { forwardRef, type ElementType, type ReactNode } from "react";

type ContainerProps<T extends ElementType = "div"> = {
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

function cx(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

// Ölçülər globals.css-dəki `.site-container` / `--site-*` tokenlərindən gəlir —
// navbar və footer də eyni mənbəyə baxır, ona görə burada rəqəm yazma.
const BASE_CLASSES = "site-container";

const Container = forwardRef<HTMLElement, ContainerProps>(function Container(
  { as, children, className, ...rest },
  ref
) {
  const Component = (as ?? "div") as ElementType;
  return (
    <Component ref={ref} className={cx(BASE_CLASSES, className)} {...rest}>
      {children}
    </Component>
  );
});

export default Container;
