import json
import sys


def emit(payload, exit_code=0):
    sys.stdout.write(json.dumps(payload))
    sys.stdout.flush()
    raise SystemExit(exit_code)


def main():
    try:
        from prophet import Prophet
        import pandas as pd
    except Exception as exc:
        emit(
            {
                "ok": False,
                "error": "Python dependencies for FB Prophet are not installed. Run pip install -r server/python/fb_prophet/requirements.txt",
                "details": str(exc),
            },
            1,
        )

    try:
        payload = json.load(sys.stdin)
    except Exception as exc:
        emit({"ok": False, "error": f"Invalid JSON payload: {exc}"}, 1)

    history = payload.get("history") or []
    periods = int(payload.get("periods") or 0)
    frequency = payload.get("frequency") or "D"

    if not history or periods <= 0:
        emit({"ok": False, "error": "History and periods are required."}, 1)

    try:
        frame = pd.DataFrame(history)
        frame["ds"] = pd.to_datetime(frame["ds"])
        frame["y"] = pd.to_numeric(frame["y"], errors="coerce").fillna(0).clip(lower=0)
        frame = frame.sort_values("ds")

        model = Prophet(
            daily_seasonality=frequency == "D",
            weekly_seasonality=frequency in ("D", "W-MON"),
            yearly_seasonality=True,
            seasonality_mode="additive",
        )
        model.fit(frame)

        future = model.make_future_dataframe(periods=periods, freq=frequency, include_history=False)
        forecast = model.predict(future)
        values = forecast["yhat"].clip(lower=0).round(2).tolist()

        emit({"ok": True, "forecast": values}, 0)
    except Exception as exc:
        emit({"ok": False, "error": f"FB Prophet forecasting failed: {exc}"}, 1)


if __name__ == "__main__":
    main()
