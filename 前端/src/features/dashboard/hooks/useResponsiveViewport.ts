import { useEffect, useState } from "react";

export function useResponsiveViewport() {
  const [isPortrait, setIsPortrait] = useState(false);
  const [bypassPortrait, setBypassPortrait] = useState(false);
  const [isExtraWide, setIsExtraWide] = useState(false);

  useEffect(() => {
    const handleOrientationAndWidth = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
      setIsExtraWide(window.innerWidth >= 1000);
    };
    handleOrientationAndWidth();
    window.addEventListener("resize", handleOrientationAndWidth);
    return () => window.removeEventListener("resize", handleOrientationAndWidth);
  }, []);

  return {
    isPortrait,
    bypassPortrait,
    setBypassPortrait,
    isExtraWide
  };
}
