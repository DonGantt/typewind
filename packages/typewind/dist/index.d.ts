declare const typewind: unique symbol;
type TypewindError<T> = {
    [typewind]: T;
};
declare const tw: TypewindError<"Typewind's types haven't been generated. Run `npx typewind generate` or follow the docs at https://typewind.dev/docs/installation">;

export { tw };
