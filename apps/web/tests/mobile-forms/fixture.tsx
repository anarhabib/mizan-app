import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import type {
  ProductCategory,
  ProductCreateInput,
  ProductDetail,
  RepairCommand,
  RepairDetail,
  SupplierOption,
} from "@mizan/contracts";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProductPanel } from "@/features/products/components/ProductPanel";
import {
  RepairEditor,
  RepairSubmit,
} from "@/features/products/components/RepairEditor";
import {
  productDefaults,
  ProductFields,
} from "@/features/products/components/ProductForm";
import type { ProductFormValues } from "@/features/products/lib/form";
import { SupplierPicker } from "@/features/suppliers/components/SupplierPicker";
import i18n from "@/shared/lib/i18n";
import "@/index.css";

const savedProduct: ProductDetail = {
  id: "saved-ring",
  code: "R1",
  name: "Ring",
  category: "Ring",
  purity: 585,
  weight: "2.001",
  netGoldWeight: "1.500",
  acquisitionCostPerGram: { amount: "50", currency: "AZN" },
  status: "IN_STOCK",
  note: null,
  createdAt: "2026-11-24T00:00:00Z",
  photo: null,
  movements: [],
  sale: null,
};

function WeightFields({
  product,
  currency,
}: {
  product?: ProductDetail;
  currency: string;
}) {
  const categories = useQuery({
    queryKey: ["fixture-categories"],
    queryFn: (): ProductCategory[] => [],
  });
  const form = useForm<ProductFormValues, unknown, ProductCreateInput>({
    defaultValues: productDefaults(currency, product),
  });
  return (
    <ProductFields
      form={form}
      product={product}
      categories={categories}
      busy={false}
      purities={[585]}
    />
  );
}

function Fixture() {
  const [opener, setOpener] = useState<HTMLButtonElement>();
  const [supplier, setSupplier] = useState<SupplierOption>();
  const [submissions, setSubmissions] = useState(0);
  const [rows, setRows] = useState(() =>
    new URLSearchParams(location.search).has("short") ? 1 : 10,
  );
  const [expanded, setExpanded] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const mobile = useIsMobile();
  const weights = new URLSearchParams(location.search).get("weights");
  const footer = mobile && !new URLSearchParams(location.search).has("inline");
  const save = (
    <Button type="submit" form="intake" className="min-h-11 lg:min-h-9">
      Save intake
    </Button>
  );

  return (
    <>
      <Button onClick={(event) => setOpener(event.currentTarget)}>
        Open intake
      </Button>
      {opener && (
        <ProductPanel
          title="Intake"
          descriptionId="intake-help"
          opener={opener}
          close={() => setOpener(undefined)}
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
            {weights && (
              <>
                <fieldset aria-label="First product">
                  <WeightFields
                    currency="AZN"
                    product={weights === "edit" ? savedProduct : undefined}
                  />
                </fieldset>
                {weights === "bulk" && (
                  <fieldset aria-label="Second product">
                    <WeightFields currency="USD" />
                  </fieldset>
                )}
              </>
            )}
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

function RepairFixture({ action }: { action: "send" | "complete" }) {
  const [opener, setOpener] = useState<HTMLButtonElement>();
  const [command, setCommand] = useState<RepairCommand>();
  const product = {
    ...savedProduct,
    gemstones: [
      { gemstoneType: "Ruby", stoneCount: 2, totalCarats: "0.34567" },
    ],
  };
  const repair: RepairDetail = {
    id: "00000000-0000-4000-8000-000000000001",
    status: "ACTIVE",
    repairerName: "Atlas Gold",
    description: "Replace the setting",
    sentDate: "2026-01-01",
    expectedReturnDate: null,
    completedDate: null,
    before: {
      weight: product.weight,
      netGoldWeight: "1.500",
      gemstones: product.gemstones,
    },
    after: null,
    events: [],
  };
  return (
    <>
      <Button onClick={(event) => setOpener(event.currentTarget)}>
        Open repair
      </Button>
      {command && (
        <output aria-label="Saved command">{JSON.stringify(command)}</output>
      )}
      {opener && (
        <ProductPanel
          title="Repair form"
          opener={opener}
          close={() => setOpener(undefined)}
          mobileFooter={
            <RepairSubmit id="repair" action={action} pending={false} />
          }
        >
          <RepairEditor
            view={action === "send" ? { action } : { action, repair }}
            product={product}
            scope={{ organizationId: "fixture-org", storeId: "fixture-store" }}
            id="repair"
            defaultCurrency="AZN"
            currencies={["AZN", "USD"]}
            pending={false}
            error={null}
            onBack={() => setOpener(undefined)}
            save={async (command) => {
              setCommand(command);
              setOpener(undefined);
            }}
          />
        </ProductPanel>
      )}
    </>
  );
}

await i18n.changeLanguage("en");
const params = new URLSearchParams(location.search);
const repairAction = params.get("repair");
document.documentElement.classList.toggle("dark", params.has("dark"));
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    {repairAction === "send" || repairAction === "complete" ? (
      <RepairFixture action={repairAction} />
    ) : (
      <Fixture />
    )}
  </QueryClientProvider>,
);
