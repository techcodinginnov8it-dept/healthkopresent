import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";
import type { RealtimeEvent } from "@/lib/dashboard/types";

export async function broadcastDashboardEvent(event: RealtimeEvent): Promise<void> {
  try {
    const supabase = createAdminClient();
    const channel = supabase.channel("healthko:dashboard");
    
    // Subscribe and send
    await new Promise<void>((resolve) => {
      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.send({
            type: "broadcast",
            event: "dashboard:event",
            payload: event,
          });
          await supabase.removeChannel(channel);
          resolve();
        } else if (status === "TIMED_OUT" || status === "CHANNEL_ERROR") {
          await supabase.removeChannel(channel);
          resolve();
        }
      });
      // Safety timeout after 3 seconds
      setTimeout(async () => {
        try {
          await supabase.removeChannel(channel);
        } catch {}
        resolve();
      }, 3000);
    });
  } catch (err) {
    console.warn("[broadcastDashboardEvent] Failed to broadcast event:", err);
  }
}
