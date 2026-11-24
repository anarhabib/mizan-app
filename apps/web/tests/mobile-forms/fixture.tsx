import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SupplierOption } from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProductPanel } from "@/features/products/components/ProductPanel";
import { SupplierPicker } from "@/features/suppliers/components/SupplierPicker";
import i18n from "@/shared/lib/i18n";
import "@/index.css";

function Fixture() {
  const opener = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [supplier, setSupplier] = useState<SupplierOption>();
  const [submissions, setSubmissions] = useState(0);
  const [rows, setRows] = useState(() =>
    new URLSearchParams(location.search).has("short") ? 1 : 10,
  );
  const [expanded, setExpanded] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const mobile = useIsMobile();
  const footer = mobile && !new URLSearchParams(location.search).has("inline");
  const save = (
    <Button type="submit" form="intake" className="min-h-11 lg:min-h-9">
      Save intake
    </Button>
  );

  return (
    <>
      <Button ref={opener} onClick={() => setOpen(true)}>
        Open intake
      </Button>
      {open && opener.current && (
        <ProductPanel
          title="Intake"
          descriptionId="intake-help"
          opener={opener.current}
          close={() => setOpen(false)}
          mobileFooter={footer ? save : undefined}
        >
          <form
            id="intake"
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmissions((count) => count + 1);
            }}
          >
            <p id="intake-help">Mobile form fixture</p>
            <label>
              Reference <Input name="reference" required />
            </label>
            <output>Submissions: {submissions}</output>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setRows(rows + 1)}>
                Add row
              </Button>
              <Button
                type="button"
                disabled={rows === 1}
                onClick={() => setRows(rows - 1)}
              >
                Remove row
              </Button>
              <Button type="button" onClick={() => setExpanded(!expanded)}>
                Toggle fields
              </Button>
              <Button type="button" onClick={() => setInvalid(!invalid)}>
                Toggle error
              </Button>
            </div>
            {Array.from({ length: rows }, (_, index) => (
              <fieldset key={index} className="grid gap-2">
                <legend>Product {index + 1}</legend>
                {expanded && (
                  <>
                    <label>
                      Code {index + 1}
                      <Input />
                    </label>
                    <label>
                      Weight {index + 1}
                      <Input />
                    </label>
                  </>
                )}
                {invalid && <p role="alert">Check the product details.</p>}
              </fieldset>
            ))}
            <SupplierPicker
              scope={{
                organizationId: "fixture-org",
                storeId: "fixture-store",
              }}
              value={supplier}
              onChange={setSupplier}
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="min-w-0">
                From <Input type="date" defaultValue="2026-11-24" />
              </label>
              <label className="min-w-0">
                To <Input type="date" />
              </label>
            </div>
            {!footer && save}
          </form>
        </ProductPanel>
      )}
    </>
  );
}

await i18n.changeLanguage("en");
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <Fixture />
  </QueryClientProvider>,
);
