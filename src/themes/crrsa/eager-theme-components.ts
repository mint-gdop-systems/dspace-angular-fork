/* eslint-disable dspace-angular-ts/themed-component-usages */

import { FileSectionComponent } from "src/app/item-page/simple/field-components/file-section/file-section.component";
import { AdminDashboardPageComponent } from "src/themes/crrsa/app/admin/admin-dashboard-page/admin-dashboard-page.component";
import { UserDashboardComponent } from "src/themes/crrsa/app/admin/user-dashboard-page/user-dashboard-page.component";
import { ItemListPreviewComponent } from "src/themes/crrsa/app/shared/object-list/my-dspace-result-list-element/item-list-preview/item-list-preview.component";
import { FilePreviewPanelComponent } from "src/themes/crrsa/app/shared/upload/file-preview-panel/file-preview-panel.component";
import { UploaderComponent } from "src/themes/crrsa/app/shared/upload/uploader/uploader.component";
import { SubmissionFormComponent } from "src/themes/crrsa/app/submission/form/submission-form.component";
import { SubmissionUploadFilesComponent } from "src/themes/crrsa/app/submission/form/submission-upload-files/submission-upload-files.component";
import { SubmissionSectionUploadFileEditComponent } from "src/themes/crrsa/app/submission/sections/upload/file/edit/section-upload-file-edit.component";
import { SubmissionSectionUploadFileComponent } from "src/themes/crrsa/app/submission/sections/upload/file/section-upload-file.component";
import { AdminSidebarComponent } from "./app/admin/admin-sidebar/admin-sidebar.component";
import { HeaderComponent } from "./app/header/header.component";
import { HeaderNavbarWrapperComponent } from "./app/header-nav-wrapper/header-navbar-wrapper.component";
import { HomeNewsComponent } from "./app/home-page/home-news/home-news.component";
import { NavbarComponent } from "./app/navbar/navbar.component";
import { MyDSpaceStatusBadgeComponent } from "./app/shared/object-collection/shared/badges/my-dspace-status-badge/my-dspace-status-badge.component";
import { ItemEditBitstreamBundleComponent } from "src/themes/crrsa/app/item-page/edit-item-page/item-bitstreams/item-edit-bitstream-bundle/item-edit-bitstream-bundle.component";
import { ItemBitstreamsComponent } from "src/themes/crrsa/app/item-page/edit-item-page/item-bitstreams/item-bitstreams.component";

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
	SubmissionSectionUploadFileEditComponent,
	FileSectionComponent,
	ItemListPreviewComponent,
	MyDSpaceStatusBadgeComponent,
	ItemBitstreamsComponent,
	ItemEditBitstreamBundleComponent
];
