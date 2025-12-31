You are given a task to integrate an existing React component in the codebase

The codebase should support:
- shadcn project structure  
- Tailwind CSS
- Typescript

If it doesn't, provide instructions on how to setup project via shadcn CLI, install Tailwind or Typescript.

Determine the default path for components and styles. 
If default path for components is not /components/ui, provide instructions on why it's important to create this folder
Copy-paste this component to /components/ui folder:
```tsx
loading-lines.tsx
import React from "react";

const LoadingLines: React.FC = () => {
  const letters = "Loading".split("");

  return (
    <div className="relative flex items-center justify-center h-[120px] w-auto m-8 font-poppins text-[1.6em] font-semibold select-none text-white scale-[2]">
      {/* Animated letters */}
      {letters.map((letter, idx) => (
        <span
          key={idx}
          className="relative inline-block opacity-0 z-[2] animate-[letterAnim_4s_linear_infinite] text-black dark:text-white"
          style={{ animationDelay: `${0.1 + idx * 0.105}s` }}
        >
          {letter}
        </span>
      ))}

      {/* Loader background */}
      <div className="absolute top-0 left-0 w-full h-full z-[1] bg-transparent [mask:repeating-linear-gradient(90deg,transparent_0,transparent_6px,black_7px,black_8px)]">
        <div className="absolute top-0 left-0 w-full h-full 
          [background-image:radial-gradient(circle_at_50%_50%,#ff0_0%,transparent_50%),radial-gradient(circle_at_45%_45%,#f00_0%,transparent_45%),radial-gradient(circle_at_55%_55%,#0ff_0%,transparent_45%),radial-gradient(circle_at_45%_55%,#0f0_0%,transparent_45%),radial-gradient(circle_at_55%_45%,#00f_0%,transparent_45%)]
          [mask:radial-gradient(circle_at_50%_50%,transparent_0%,transparent_10%,black_25%)]
          animate-[transformAnim_2s_infinite_alternate_cubic-bezier(0.6,0.8,0.5,1),opacityAnim_4s_infinite]" />
      </div>

      <style jsx>{`
        @keyframes transformAnim {
          0% {
            transform: translate(-55%);
          }
          100% {
            transform: translate(55%);
          }
        }

        @keyframes opacityAnim {
          0%,
          100% {
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          65% {
            opacity: 0;
          }
        }

        @keyframes letterAnim {
          0% {
            opacity: 0;
          }
          5% {
            opacity: 1;
            text-shadow: 0 0 4px #fff;
            transform: scale(1.1) translateY(-2px);
          }
          20% {
            opacity: 0.2;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingLines;


demo.tsx
import LoadingLines from "@/components/ui/loading-lines";

export default function DemoOne() {
  return <LoadingLines />;
}

```
