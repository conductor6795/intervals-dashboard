import { NextRequest, NextResponse } from "next/server";

const BASE = "https://intervals.icu/api/v1/athlete";

function authHeader() {
  const key = process.env.INTERVALS_API_KEY ?? "";
  return "Basic " + Buffer.from(`API_KEY:${key}`).toString("base64");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const athleteId = process.env.INTERVALS_ATHLETE_ID;
  if (!athleteId) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  const { id } = await params;

  const fields =
    "id,start_date_local,type,name,moving_time,elapsed_time,coasting_time," +
    "distance,total_elevation_gain,average_heartrate,max_heartrate," +
    "average_speed,max_speed,average_cadence,average_temp,calories,carbs_used," +
    "icu_training_load,power_load,hr_load,strain_score," +
    "icu_intensity,average_watts,icu_average_watts,max_watts,icu_weighted_avg_watts," +
    "icu_efficiency_factor,icu_variability_index,icu_power_hr,polarization_index,decoupling," +
    "icu_zone_times,icu_hr_zone_times,icu_ftp," +
    "race,commute,sub_type,description,icu_rpe," +
    "average_stride_length,avg_ground_contact_time,avg_vertical_oscillation,avg_vertical_ratio,avg_lr_balance";

  try {
    const res = await fetch(`${BASE}/${athleteId}/activities/${id}?fields=${fields}`, {
      headers: { Authorization: authHeader() },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `${res.status} ${text}` }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
