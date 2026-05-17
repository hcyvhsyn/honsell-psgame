import { forwardRef, type ElementType, type ReactNode } from "react";

type ContainerProps<T extends ElementType = "div"> = {
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

function cx(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

const BASE_CLASSES = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

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
