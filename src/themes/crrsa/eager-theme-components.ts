/* eslint-disable dspace-angular-ts/themed-component-usages */

import { AdminSidebarComponent } from "./app/admin/admin-sidebar/admin-sidebar.component";
import { HeaderComponent } from "./app/header/header.component";
import { HeaderNavbarWrapperComponent } from "./app/header-nav-wrapper/header-navbar-wrapper.component";
import { HomeNewsComponent } from "./app/home-page/home-news/home-news.component";
import { NavbarComponent } from "./app/navbar/navbar.component";
import { AdminDashboardPageComponent } from "src/themes/crrsa/app/admin/admin-dashboard-page/admin-dashboard-page.component";
import { UserDashboardComponent } from "src/themes/crrsa/app/admin/user-dashboard-page/user-dashboard-page.component";
import { FilePreviewPanelComponent } from "src/themes/crrsa/app/shared/upload/file-preview-panel/file-preview-panel.component";
import { UploaderComponent } from "src/themes/crrsa/app/shared/upload/uploader/uploader.component";
import { SubmissionUploadFilesComponent } from "src/themes/crrsa/app/submission/form/submission-upload-files/submission-upload-files.component";
import { SubmissionFormComponent } from "src/themes/crrsa/app/submission/form/submission-form.component";
import { SubmissionSectionUploadFileComponent } from "src/themes/crrsa/app/submission/sections/upload/file/section-upload-file.component";
import { SubmissionSectionUploadFileEditComponent } from "src/themes/crrsa/app/submission/sections/upload/file/edit/section-upload-file-edit.component";

export const COMPONENTS = [
	AdminSidebarComponent,
	HomeNewsComponent,
	HeaderComponent,
	HeaderNavbarWrapperComponent,
	NavbarComponent,
	AdminDashboardPageComponent,
	UserDashboardComponent,
	FilePreviewPanelComponent,
	UploaderComponent,
	SubmissionUploadFilesComponent,
	SubmissionFormComponent,
	SubmissionSectionUploadFileComponent,
	SubmissionSectionUploadFileEditComponent
];
