"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";
import {
  submitCompletePickList,
  submitCreatePickList,
  submitDeliverShipment,
  submitPickListItem,
  submitShipRequest,
} from "@/features/outbound/actions/outboundActions";
import type {
  OutboundRequestDetail,
  PickList,
  PickListItem,
} from "@/features/outbound/types";
import { pickListStatusTone } from "@/features/outbound/types";

/* ------------------------------------------------------------------ */
/* Pick list line — editable picked quantity + location               */
/* ------------------------------------------------------------------ */

function PickListRow({
  requestId,
  pickList,
  item,
  editable,
  productLabel,
}: {
  requestId: string;
  pickList: PickList;
  item: PickListItem;
  editable: boolean;
  productLabel: (id: string) => string;
}) {
  const [quantity, setQuantity] = useState(String(item.quantity_picked ?? 0));
  const [location, setLocation] = useState(item.location ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const target = item.quantity_requested;

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await submitPickListItem(
        requestId,
        String(pickList.id),
        String(item.product_id),
        {
          quantity_picked: Number(quantity),
          location: location.trim() || undefined,
        },
      );
      if (result.ok) {
        setSaved(true);
      } else {
        setError(result.error ?? "Could not save this line.");
      }
    });
  };

  return (
    <div className="grid items-center gap-2 border-b border-slate-100 py-3 last:border-b-0 sm:grid-cols-[1fr_auto_auto_auto]">
      <div>
        <p className="text-sm font-medium text-slate-900">
          {productLabel(String(item.product_id))}
        </p>
        {target !== undefined && (
          <p className="text-xs text-slate-500">
            Target: {formatNumber(target)} units
          </p>
        )}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {saved && !error && (
          <p className="mt-1 text-xs text-emerald-600">Saved.</p>
        )}
      </div>
      <div className="w-24">
        <Input
          type="number"
          min="0"
          step="1"
          value={quantity}
          onChange={(e) => {
            setQuantity(e.target.value);
            setSaved(false);
          }}
          disabled={!editable}
          aria-label={`Picked quantity for ${item.product_name ?? item.product_id}`}
        />
      </div>
      <div className="w-32">
        <Input
          value={location}
          onChange={(e) => {
            setLocation(e.target.value);
            setSaved(false);
          }}
          placeholder="Bin / location"
          disabled={!editable}
          aria-label={`Location for ${item.product_name ?? item.product_id}`}
        />
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={save}
        isLoading={isPending}
        disabled={!editable}
      >
        Save
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Whole workflow: create pick list → pick → complete → ship → deliver */
/* ------------------------------------------------------------------ */

const steps = ["Pick", "Pack", "Ship", "Deliver"] as const;

function stepIndex(status: OutboundRequestDetail["status"]): number {
  switch (status) {
    case "requested":
      return 0;
    case "picking":
      return 0;
    case "packed":
      return 2;
    case "shipped":
      return 3;
    case "delivered":
      return 4;
    default:
      return 0;
  }
}

export function OutboundWorkflow({
  request,
  productLabel,
}: {
  request: OutboundRequestDetail;
  productLabel: (id: string) => string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [isPending, startTransition] = useTransition();

  const requestId = String(request.id);
  const cancelled = request.status === "cancelled";
  const currentStep = stepIndex(request.status);
  // the API returns a list; in practice a request has at most one shipment
  const shipment = request.shipments.length
    ? request.shipments[request.shipments.length - 1]
    : null;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Operation failed.");
    });
  };

  const canCreatePickList =
    !cancelled &&
    request.pick_lists.length === 0 &&
    (request.status === "requested" || request.status === "picking");

  return (
    <div className="space-y-6">
      {/* Progress rail */}
      <Card>
        <ol className="flex items-center gap-2">
          {steps.map((step, index) => {
            const done = currentStep > index;
            const active = currentStep === index && !cancelled;
            return (
              <li key={step} className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    done && "bg-emerald-500 text-white",
                    active && "bg-indigo-600 text-white",
                    !done && !active && "bg-slate-100 text-slate-400",
                  )}
                >
                  {done ? "✓" : index + 1}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    done || active
                      ? "font-medium text-slate-900"
                      : "text-slate-400",
                  )}
                >
                  {step}
                </span>
                {index < steps.length - 1 && (
                  <span className="mx-1 h-px flex-1 bg-slate-200" />
                )}
              </li>
            );
          })}
        </ol>
        {cancelled && (
          <p className="mt-3 text-sm font-medium text-red-600">
            This request was cancelled — the workflow is locked.
          </p>
        )}
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Picking */}
      <Card
        title="Pick lists"
        description="Record what was actually picked per line, then complete the list"
        actions={
          canCreatePickList ? (
            <Button
              size="sm"
              isLoading={isPending}
              onClick={() => run(() => submitCreatePickList(requestId))}
            >
              Create pick list
            </Button>
          ) : undefined
        }
      >
        {request.pick_lists.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">
            {canCreatePickList
              ? "No pick list yet — create one to start picking."
              : "No pick lists on this request."}
          </p>
        ) : (
          <div className="space-y-5">
            {request.pick_lists.map((pickList) => {
              const editable =
                !cancelled &&
                pickList.status !== "complete" &&
                (request.status === "requested" || request.status === "picking");
              return (
                <div
                  key={String(pickList.id)}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">
                      Pick list #{String(pickList.id)}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge tone={pickListStatusTone(pickList.status)}>
                        {pickList.status.replace(/_/g, " ")}
                      </Badge>
                      {editable && (
                        <Button
                          size="sm"
                          isLoading={isPending}
                          onClick={() =>
                            run(() =>
                              submitCompletePickList(
                                requestId,
                                String(pickList.id),
                              ),
                            )
                          }
                        >
                          Complete pick list
                        </Button>
                      )}
                    </div>
                  </div>
                  <div>
                    {pickList.items.map((item) => (
                      <PickListRow
                        key={String(item.product_id)}
                        requestId={requestId}
                        pickList={pickList}
                        item={item}
                        editable={editable}
                        productLabel={productLabel}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Shipping */}
      <Card
        title="Shipment"
        description="Hand the packed request to a carrier, then mark it delivered"
      >
        {shipment ? (
          <div className="space-y-3">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Carrier
                </dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {shipment.carrier ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Tracking number
                </dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {shipment.tracking_number ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Shipped
                </dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {formatDateTime(shipment.shipped_at)}
                </dd>
              </div>
            </dl>
            {request.status === "shipped" && (
              <Button
                isLoading={isPending}
                onClick={() =>
                  run(() =>
                    submitDeliverShipment(requestId, String(shipment.id)),
                  )
                }
              >
                Mark as delivered
              </Button>
            )}
            {request.status === "delivered" && (
              <p className="text-sm font-medium text-emerald-600">
                Delivered
                {shipment.delivered_at
                  ? ` on ${formatDateTime(shipment.delivered_at)}`
                  : ""}
                .
              </p>
            )}
          </div>
        ) : request.status === "packed" ? (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              run(() =>
                submitShipRequest(requestId, {
                  carrier: carrier.trim(),
                  tracking_number: tracking.trim(),
                }),
              );
            }}
          >
            <div className="w-48">
              <Input
                label="Carrier"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="e.g. DHL"
                required
              />
            </div>
            <div className="w-64">
              <Input
                label="Tracking number"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="e.g. JD014600003RS"
                required
              />
            </div>
            <Button type="submit" isLoading={isPending}>
              Ship
            </Button>
          </form>
        ) : (
          <p className="py-2 text-sm text-slate-400">
            {cancelled
              ? "Cancelled requests cannot be shipped."
              : "Complete all pick lists first — shipping unlocks once the request is packed."}
          </p>
        )}
      </Card>
    </div>
  );
}
