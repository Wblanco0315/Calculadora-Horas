import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "./app/app.component";
import { appConfig } from "./app/app.config";
import { hideAppLoader } from "./app/core/utils/app-loader.util";

bootstrapApplication(AppComponent, appConfig).catch((err) => {
  console.error(err);
  hideAppLoader();
});
// reload trigger

